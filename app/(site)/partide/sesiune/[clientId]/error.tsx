'use client';

import { useEffect, useTransition } from 'react';
import { DetailBackButton, DetailError } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';

/*
 * The resolver could not run — in practice the session gate's «unknown» (requireViewer throws
 * SessionUnknownError when /users/me fails or times out: never a redirect to sign-in, owner rule 4).
 * The partidă page's card (../../[id]/error.tsx): «Nu am putut încărca partida.» + «Reîncearcă»,
 * which re-renders the segment — a fresh session read, then the resolution.
 */
export default function PartidaSessionError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, start] = useTransition();
  useEffect(() => {
    console.warn('[partida-session]', error);
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
