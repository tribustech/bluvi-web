'use client';

import { useEffect, useTransition } from 'react';
import { DetailBackButton, DetailError } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../_shell/SiteHeader';

/*
 * The partidă page crashed (the route's error boundary; a failed READ never lands here — the
 * browser's query reads again and shows its own error state, _spectator/states.tsx). Same card and
 * copy as that state (fish comunitate/[id].tsx :301-312): «Nu am putut încărca partida.» +
 * «Reîncearcă», which re-renders the segment and says so while it runs.
 */
export default function PartidaError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, start] = useTransition();
  useEffect(() => {
    console.warn('[partida]', error);
  }, [error]);
  return (
    <div data-testid="partida-error">
      <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: 'Eroare' }]} />
      <DetailError
        back={<DetailBackButton fallbackHref={routes.partide()} ground="page" />}
        heading="Nu am putut încărca partida."
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
