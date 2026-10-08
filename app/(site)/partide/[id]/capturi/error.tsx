'use client';

import { useEffect, useTransition } from 'react';
import { ListError, ListHeader, ListPage } from '@/components/templates/T1';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';

/*
 * The catches page crashed (the route's error boundary; a failed READ never lands here — the
 * browser's queries read again and show their own error, _list/CatchesView.tsx). The title row
 * stays, with the same card and copy as that state and «Reîncearcă», which re-renders the segment.
 */
export default function PartidaCatchesError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, start] = useTransition();
  useEffect(() => {
    console.warn('[partida-capturi]', error);
  }, [error]);
  return (
    <ListPage header={<ListHeader title="Capturi" titleId="capturi-titlu" back={{ label: 'Înapoi la partide', href: routes.partide() }} />}>
      <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: 'Eroare' }]} />
      <div data-testid="catches-error">
        <ListError
          title="Nu am putut încărca capturile."
          description={`Verifică conexiunea și reîncearcă.${error.digest ? ` Cod: ${error.digest}` : ''}`}
          onRetry={() => !pending && start(() => retry())}
          retrying={pending}
          retryLabel="Reîncearcă"
          focusOnMount
        />
      </div>
    </ListPage>
  );
}
