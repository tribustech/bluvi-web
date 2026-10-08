'use client';

import { useEffect, useTransition } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { DetailBackButton, DetailError } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/*
 * The gallery crashed (the route's error boundary; a failed READ never lands here — the browser's
 * queries read again and show their own error states). «Galeria nu a putut fi încărcată.» +
 * «Reîncearcă», which re-renders the segment and says so while it runs.
 */
export default function PartidaGalleryError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, start] = useTransition();
  useEffect(() => {
    console.warn('[partida galerie]', error);
  }, [error]);
  return (
    <div data-testid="partida-gallery-crash">
      <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: 'Eroare' }]} />
      <DetailError
        back={<DetailBackButton fallbackHref={routes.partide()} ground="page" />}
        heading="Galeria nu a putut fi încărcată."
        description={`Verifică conexiunea și reîncearcă.${error.digest ? ` Cod: ${error.digest}` : ''}`}
        action={
          <Button aria-busy={pending || undefined} aria-disabled={pending || undefined} onClick={() => !pending && start(() => retry())}>
            {pending ? 'Se încarcă…' : 'Reîncearcă'}
          </Button>
        }
      />
    </div>
  );
}
